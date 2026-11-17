import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { nid, dob, userId } = req.body;
  if (!nid || !dob || !userId) return res.status(400).json({ error: 'Missing fields' });

  try {
    // 1. Check user credits in DB (Server side validation)
    const { data: credits, error: cErr } = await supabaseAdmin
      .from('user_credits')
      .select('credits_remaining')
      .eq('user_id', userId)
      .single();

    if (cErr || !credits || credits.credits_remaining < 1) {
      return res.status(403).json({ success: false, message: 'Insufficient credits' });
    }

    // 2. Call External API
    const apiRes = await fetch(`https://itsheba.store/Api/T/api/main.php?nid=${nid}&dob=${dob}`);
    const apiData = await apiRes.json();

    if (apiData.success && apiData.code === 200) {
      // 3. Success -> Deduct credit & log
      const newCredits = credits.credits_remaining - 1;
      
      await supabaseAdmin.from('user_credits')
        .update({ credits_remaining: newCredits, total_used: supabaseAdmin.rpc('increment') }) // Simplified for now
        .eq('user_id', userId);

      // Return filtered data
      return res.status(200).json({
        success: true,
        data: apiData.data
      });
    } else {
      // Failed -> Do NOT deduct credit
      return res.status(200).json({ success: false, message: 'Data not found or API error' });
    }

  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}