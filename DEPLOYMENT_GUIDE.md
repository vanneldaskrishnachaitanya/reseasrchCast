# Deploying Paper to Podcast (For Free)

Since we skipped using the Git command line, you will need to start by uploading your project to GitHub manually. This guide will take you step-by-step from zero to a fully deployed live web app.

---

## Step 1: Upload your code to GitHub
1. Go to [GitHub.com](https://github.com/) and sign up or log in.
2. Click the **+** icon in the top right and select **New repository**.
3. Name your repository (e.g., `papercast-ai`), leave it "Public" or "Private", and **DO NOT** check any of the initialization boxes. Click **Create repository**.
4. You will see a "Quick setup" screen. Click the **"uploading an existing file"** link near the top of the page.
5. Open your `d:\papercast` folder in Windows File Explorer.
6. Drag **everything in the folder** into the GitHub webpage EXCEPT the items we put in your `.gitignore`. 
   - *Do not upload:* `venv`, `__pycache__`, `.env`, `outputs`, `uploads`, `.pytest_cache`, `.vscode`.
7. Wait for the upload, then click **Commit changes**.

---

## Step 2: Deploy the Backend (FastAPI) on Render
1. Go to [Render.com](https://render.com/) and sign up with GitHub.
2. Click **New +** and select **Web Service**.
3. Under "Connect a repository", find the GitHub repo you just created and click **Connect**.
4. Configure the service:
   - **Name:** `papercast-backend`
   - **Environment:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port 10000`
   - **Instance Type:** Select the **Free** tier.
5. Scroll down to **Advanced** and click **Add Environment Variable**. Add all the variables from your local `.env` file!
   - `GOOGLE_API_KEY`, `ELEVENLABS_API_KEY`, `ANTHROPIC_API_KEY` (if used), `OPENAI_API_KEY` (if used), etc.
   - Also add `UPLOAD_DIR`=`/tmp` and `OUTPUT_DIR`=`/tmp` (since the free tier has ephemeral disk storage).
6. Click **Create Web Service**. 
7. Wait ~5-10 minutes for your backend to build. Once it's Live, **copy the deployment URL** (it will look like `https://papercast-backend.onrender.com`).

---

## Step 3: Deploy the Frontend (React) on Vercel
1. Go to [Vercel.com](https://vercel.com/) and sign up with GitHub.
2. On the dashboard, click **Add New...** -> **Project**.
3. Find your GitHub repository and click **Import**.
4. Configure the project:
   - Expand the **Framework Preset** dropdown and select **Vite**.
   - Expand the **Root Directory** section, click Edit, and select the `frontend` folder (since your React app is inside the `frontend` subfolder).
5. Expand the **Environment Variables** section and add:
   - **Name:** `VITE_API_URL`
   - **Value:** Paste the URL you copied from Render in Step 2 (e.g., `https://papercast-backend.onrender.com/api`). *Make sure you add `/api` to the end!*
   - Also add your Firebase variables here (`VITE_FIREBASE_API_KEY`, etc.) from your `frontend/.env` file.
6. Click **Deploy**.
7. Wait ~2 minutes for the build to finish. Vercel will give you a live URL for your frontend!

---

**That's it!** If you go to your shiny new Vercel URL, your full-stack AI application will be live on the internet!
