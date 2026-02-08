This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Dev bypass (optional)

For faster local navigation without logging in each time:

```bash
NEXT_PUBLIC_DEV_BYPASS_AUTH=true
NEXT_PUBLIC_DEV_BYPASS_ROLE=privat
```

Valid roles for `NEXT_PUBLIC_DEV_BYPASS_ROLE` are: `privat`, `brf`, `entreprenor`, `osaker`.

In development mode, a floating `Dev meny` is also shown for quick role switching and deep links.

### AI extraction setup

To enable real AI extraction of uploaded maintenance plans:

```bash
OPENAI_API_KEY=your_api_key_here
```

Current extraction support:
- `txt`, `csv`, `md`, `json` (direct)
- `doc`, `docx`, `rtf`, `odt` (via `textutil` on macOS)
- `xls`, `xlsx`, `xlsm` (sheet parsing via `xlsx`)

Note: PDF OCR/text extraction is not enabled yet in the API route. For now, use text-based files or DOCX.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
