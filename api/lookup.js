// Vercel Serverless Function — connect only to an authorized Porichoy API.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // TODO: Validate input, authenticate the user, and call the official API.
  // Keep API credentials in Vercel Environment Variables. Never expose them
  // in public HTML/JavaScript or return sensitive identity data unnecessarily.
  return res.status(501).json({ error: "Lookup API is not configured yet." });
}
