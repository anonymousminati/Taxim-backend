# --------------------------------------------------------------------------
# Base Image: Ubuntu + Node.js 20 + Python 3.11 + Manim + MiKTeX + FFmpeg
# --------------------------------------------------------------------------
FROM ubuntu:22.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=UTC
ENV PYTHONUNBUFFERED=1
ENV MPM_AUTO_INSTALL=1
WORKDIR /app

# ------------------- Install System Dependencies -------------------------
RUN apt-get update && apt-get install -y \
    build-essential \
    ca-certificates \
    curl \
    ffmpeg \
    git \
    gnupg \
    libcairo2 \
    libcairo2-dev \
    libgl1 \
    libglib2.0-0 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libpango1.0-dev \
    lsb-release \
    ninja-build \
    pkg-config \
    python3.11 \
    python3.11-dev \
    python3.11-venv \
    python3-pip \
    software-properties-common \
    texlive-base \
    texlive-fonts-recommended \
    texlive-latex-extra \
    texlive-latex-recommended \
    wget && \
    ln -sf /usr/bin/python3.11 /usr/bin/python && \
    ln -sf /usr/bin/python3.11 /usr/bin/python3 && \
    pip3 install --no-cache-dir meson>=0.63.3 && \
    rm -rf /var/lib/apt/lists/*

# ------------------- Install Node.js 20.x -------------------------
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# ------------------- Install MiKTeX -------------------------
RUN wget -qO- https://miktex.org/download/key | gpg --dearmor > /usr/share/keyrings/miktex-keyring.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/miktex-keyring.gpg] https://miktex.org/download/ubuntu jammy universe" > /etc/apt/sources.list.d/miktex.list && \
    apt-get update && \
    apt-get install -y --allow-unauthenticated miktex && \
    miktexsetup --shared=yes finish && \
    initexmf --admin --set-config-value "[MPM]AutoInstall=1" && \
    rm -rf /var/lib/apt/lists/*

# ------------------- Install Python Libraries -------------------------
COPY requirements.txt* ./

# ------------------- Create Non-root User -------------------------
RUN groupadd -r appuser && useradd -r -g appuser appuser && \
    mkdir -p /home/appuser && chown -R appuser:appuser /home/appuser /app
USER appuser

# ------------------- Install Python Libraries as User -------------------------
RUN pip3 install --no-cache-dir --user manim==0.18.* && \
    if [ -f requirements.txt ]; then pip3 install --user -r requirements.txt; fi

# ------------------- Install Node Dependencies -------------------------
COPY --chown=appuser:appuser package*.json ./
RUN npm ci --only=production

# ------------------- Copy App Code -------------------------
COPY --chown=appuser:appuser . .

# ------------------- Environment & Runtime -------------------------
ENV NODE_ENV=production
ENV PORT=3001
ENV PATH="/home/appuser/.local/bin:$PATH"
EXPOSE 3001

# ------------------- Healthcheck -------------------------
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# ------------------- Start Command -------------------------
CMD ["npm", "start"]
