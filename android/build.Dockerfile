# Android build image for the calendar app, used by scripts/android-build.sh (no context: `docker build - < this`).
# Pinned by digest (the multi-arch index of this tag, 2026-10-16); bump tag and digest together.
FROM ghcr.io/cirruslabs/android-sdk:36@sha256:f9b3ea9ed2b5fc9522adae82c7b4622ab7aa54207ef532c8e615a347dca08f31
RUN yes | sdkmanager --install "build-tools;35.0.0" > /dev/null
