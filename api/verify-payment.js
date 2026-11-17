// Vercel Serverless Function — verify payment server-side.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // TODO: Verify the transaction directly with the payment provider.
  // Do not trust a success status sent by the browser.
  return res.status(501).json({ error: "Payment verification is not configured yet." });
}
