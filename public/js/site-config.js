import { supabase } from '/supabase-client.js';

(async () => {
  try {
    const { data } = await supabase.from('site_settings')
      .select('setting_key,setting_value')
      .in('setting_key', ['site_name', 'site_tagline']);
    const values = Object.fromEntries((data || []).map(x => [x.setting_key, x.setting_value]));
    const name = typeof values.site_name === 'string' ? values.site_name : 'HyperNIDLookUP';
    const tagline = typeof values.site_tagline === 'string' ? values.site_tagline : 'BD NID VERIFICATION';
    document.title = document.title.replace(/HyperNIDLookUP/gi, name);
    document.querySelectorAll('.brand-name, .brand-txt').forEach(el => {
      el.replaceChildren(document.createTextNode(name));
      if (el.classList.contains('brand-txt')) {
        const small = document.createElement('small');
        small.textContent = tagline;
        el.appendChild(small);
      }
    });
  } catch (error) {
    // Public branding is non-critical; keep the original page content on failure.
    console.warn('Site settings could not be loaded');
  }
})();
