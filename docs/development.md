# Development

Here's a step-by-step guide to get both frontend and backend running

Make sure your working directory is OER_tutor
```bash
cd OER_tutor # or whatever you named it 
```

## Frontend (Next.js) Setup

1. **Install dependencies**
Node.js is required. if you don't have node, this https://nodejs.org/en/download

```shell
npm install --legacy-peer-deps
```

2. **Copy env file**

```shell
cp .env.example .env
```

2.  **Start the development server**:

```shell
npm run dev
```

This will start the Next.js server, typically on [http://localhost:3000](http://localhost:3000). It's also specified in the console after launching Next.

## Backend (FastAPI) setup

Your current working directory should be the repository root still. `cd OER_tutor`

Supported python is version `3.13.*`. you can find this with `python --version`. download python here https://www.python.org/downloads/ [^1]

[^1]: I like [pyenv](https://github.com/pyenv/pyenv)

1. **Create a virtual environment** (recommended but optional)

```bash
# on macos/linux
python -m venv venv
source venv/bin/activate
```

> [!NOTE] 
> Sometimes linux likes to have the python 3 binary name as `python3` instead of just python

```bash
# on windows
python -m venv venv
venv\Scripts\activate
```

2. **Install dependencies**

Navigate into the backend folder

```shell
cd backend
```

Install python dependencies
```shell
pip install -r requirements.txt
```

3. **Setup Enviroment Variables**

Copy .env.example to .env
```shell
cp .env.example .env
```

Edit the environment variables. Langchain is optional, however `LANGSMITH_TRACING` must be set to false if not configured properly


### Configuring Langchain

Langchain is a tracing tool. (Langsmith is for chaining llm tooling)

1. Go to https://www.langchain.com/ and sign up 
2. On the left panel at the bottom, click on the gear.
3. Under API keys, in the top right click the `+ API Key Button`
4. Write a description, Select personal access token, and set the default workspace. Create the key in the bottom right
5. copy created key into backend's .env for `LANGSMITH_API_KEY`
6. set `LANGSMITH_TRACING` to true


## Site onboarding

For test developement a account is required. accounts are created in the right.

Existing addable textbooks are the following

- `PSYCH1`
- `PHYSIC`