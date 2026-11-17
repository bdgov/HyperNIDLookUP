// Vercel Serverless Function — payment initialization placeholder.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // TODO: Create a payment session with your payment provider on the server.
  return res.status(501).json({ error: "Payment setup is not configured yet." });
}
