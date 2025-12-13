# Voice Agent Annotation Tool

A Next.js application for managing and monitoring voice agent calls with OpenAI Realtime API.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env.local` file in the root directory:
   ```
   OPENAI_API_KEY=your_api_key_here
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

- `/src/app` - Next.js App Router pages
  - `/page.tsx` - Voice agent interface
  - `/dashboard/page.tsx` - Calls dashboard
  - `/actions/tokens.ts` - Server action for generating tokens
- `/src/components/ui` - shadcn UI components
- `/src/lib` - Utility functions and call tracking

## Features

- Voice agent integration with OpenAI Realtime API
- Call tracking and analytics dashboard
- Real-time call monitoring
- Issue detection and severity classification

