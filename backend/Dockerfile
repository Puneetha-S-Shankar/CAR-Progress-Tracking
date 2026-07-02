# Use the official Python 3.12 image
FROM python:3.12-slim

# Set the working directory
WORKDIR /app

# Install system dependencies if required (e.g. for psycopg2)
RUN apt-get update && apt-get install -y \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

# Install uv for fast dependency management
RUN pip install uv

# Copy the dependencies files
COPY pyproject.toml uv.lock ./

# Install dependencies using uv (without creating a virtualenv, install system-wide in container)
RUN uv pip install --system -r pyproject.toml

# Copy the rest of the application files
COPY . .

# Expose port 7860 (Hugging Face Spaces requirement)
EXPOSE 7860

# Command to run the FastAPI application on port 7860
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
