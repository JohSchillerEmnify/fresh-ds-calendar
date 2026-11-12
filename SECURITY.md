# Security policy

## Reporting a vulnerability

Please report vulnerabilities privately and do not open a public issue.

- Use GitHub's private vulnerability reporting: the repository **Security** tab → **Report a vulnerability**.

Include affected version or commit, reproduction steps and impact. We aim to acknowledge reports within a
few days and will coordinate disclosure with you.

## Scope

- the server (`server/`), including sign-in and the widget keys that let a home-screen widget read calendar data;
- the web app (`web/`) and the rules it shares with the server (`shared/`);
- the Android app and its widgets (`android/`);
- the iPhone widget script (`ios/widget/`); its installer lives in `shared/`.

Only the latest `main` is supported.
