# HyperNIDLookUP — বাংলা সেটআপ গাইড

এই ZIP-এ আগের ওয়েবসাইটের মূল ডিজাইন/পেজ রাখা হয়েছে। নিরাপত্তার জন্য Database ও API অংশে পরিবর্তন করা হয়েছে এবং Admin Control Center যোগ করা হয়েছে।

## আগে গুরুত্বপূর্ণ সতর্কতা

- এই ZIP-কে এক ক্লিকে ১০০% নিরাপদ বা সম্পূর্ণ Live Payment Gateway-সহ বলা যাবে না। কোনো ওয়েবসাইটকে ১০০% hack-proof নিশ্চিত করা সম্ভব নয়।
- Manual bKash/Nagad/Rocket payment flow আছে: User অর্ডার করবে → Admin Transaction ID দেখে যাচাই করবে → Approve করলে একবারই Credit যোগ হবে।
- SSLCommerz, bKash PGW বা Nagad automatic checkout এখনো চালু নয়। এগুলোর জন্য Merchant Account, Secret Credentials, Callback URL এবং Provider-এর Server-side Payment Verification দরকার। Browser থেকে success পাঠালে কখনো payment confirm করা হবে না।
- NID Lookup চালু হবে কেবল বৈধ ও অনুমোদিত NID Verification API-এর URL/Token Vercel-এ বসালে। ZIP-এ কোনো অননুমোদিত NID সার্ভিসের গোপন অ্যাক্সেস যোগ করা হয়নি।

## ধাপ ১ — ZIP Extract

ZIP Extract করে সব ফাইল GitHub Repository-তে Push করবে। `.git` folder বা কোনো `.env` Secret ZIP-এ রাখা হয়নি।

## ধাপ ২ — Supabase Database Reset

**সতর্কতা: পরের SQL পুরোনো Application Tables এবং তাদের Data মুছে নতুন করে বানাবে।** আগে Backup/Export করবে। `auth.users`-এর Account মুছে না দিয়ে পুরোনো User-দের Profile/Credit Row নতুন করে তৈরি করার ব্যবস্থা আছে।

1. Supabase Dashboard খুলবে।
2. SQL Editor → New Query।
3. `database/RESET_AND_INSTALL.sql` পুরোটা Paste করবে।
4. Run করবে।
5. `database/VERIFY_INSTALL.sql` চালিয়ে RLS/Function/Grant পরীক্ষা করবে।

## ধাপ ৩ — নিজের Account Admin করা

আগের Account থাকলে সেটি ব্যবহার করতে পারবে। না থাকলে ওয়েবসাইটে Signup করবে। তারপর SQL Editor-এ নিচের SQL চালাবে—নিজের Signup Email বসাবে:

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'তোমার-ইমেইল@example.com';
```

তারপর Logout করে আবার Login করবে।

## ধাপ ৪ — Vercel Environment Variables

Vercel → Project → Settings → Environment Variables-এ `.env.example` থেকে প্রয়োজনীয় মান বসাবে:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` — Supabase Publishable/Anon Key
- `SUPABASE_SERVICE_ROLE_KEY` — এটি গোপন; শুধু Vercel Server Environment-এ থাকবে
- `APP_ORIGIN` — যেমন `https://তোমার-ডোমেইন.com`
- `NID_PROVIDER_URL` ও `NID_PROVIDER_TOKEN` — অনুমোদিত NID API থাকলে

**Service Role Key, NID Provider Token কখনো HTML/JavaScript ফাইলে বা GitHub-এ দিবে না।**

## ধাপ ৫ — Deploy

GitHub-এ Push করার পর Vercel-এ Repository Import/Connect করে Deploy করবে। Environment Variable পরিবর্তনের পর নতুন Deployment দিতে হবে।

## ধাপ ৬ — Admin Control Center

নিজের Admin Account দিয়ে Login করে খুলবে:

- `/admin.html` — User, Transaction, Package তালিকা ও Manual Payment Approve/Reject
- `/admin-tools.html` — Package Add/Edit/Active, bKash/Nagad/Rocket নম্বর, Site Name/Tagline, User Role, Credit Adjustment এবং User-কে Package Grant

Manual Payment Number আগে Admin Control Center থেকে Add করবে। তারপর User Dashboard-এ Package Buy করলে Method, Number, Amount দেখাবে এবং Transaction ID/পেমেন্ট করা ফোন নম্বর জমা দিতে পারবে।

## NID Lookup চালু করার আগে

বর্তমান নিরাপদ API কেবল Server থেকে HTTPS POST করে Provider-কে `{ "nid": "...", "dob": "YYYY-MM-DD" }` পাঠায়। Provider-কে JSON-এ `success: true` অথবা `code: 200` এবং `data` দিতে হবে। তোমার API যদি অন্য Format/Method ব্যবহার করে, তার Official Documentation অনুযায়ী Adapter লিখতে হবে।

## পরীক্ষা

- সাধারণ User-এর নিজের Role পরিবর্তন করা যাবে না।
- সাধারণ User সরাসরি Credit বা Transaction Status পরিবর্তন করতে পারবে না।
- Browser থেকে অন্য User ID পাঠিয়ে Lookup/Credit ব্যবহার করা যাবে না।
- Manual Transaction একবার Approve করলে দ্বিতীয়বার Credit যোগ হবে না।
- Provider Error হলে Credit ফেরত দেওয়ার চেষ্টা হবে; Balance যাচাই করবে।
- Automatic Gateway Credentials/Verification না থাকলে Payment endpoint নিরাপদভাবে বন্ধ থাকবে।
