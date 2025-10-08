# backend/Dockerfile
FROM public.ecr.aws/lambda/python:3.12

# Copy and install Python deps first to leverage Docker layer caching
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt --target "${LAMBDA_TASK_ROOT}"

# Copy your app code into the image
# If your code is in backend/src/, set WORKDIR and copy accordingly:
WORKDIR /var/task
COPY . ./backend/

# Set the Lambda entrypoint (module:function). Keep this in sync with your file.
# If your handler is in backend/main.py -> handler = Mangum(app), this is correct:
CMD ["backend.main.handler"]