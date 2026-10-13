# Android build image for the calendar app, used by scripts/android-build.sh (no context: `docker build - < this`).
FROM ghcr.io/cirruslabs/android-sdk:36
RUN yes | sdkmanager --install "build-tools;35.0.0" > /dev/null
