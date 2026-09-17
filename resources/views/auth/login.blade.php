<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Sign in · TerminPilot</title>
    <link rel="stylesheet" href="{{ asset('styles.css') }}">
</head>
<body>
    <main class="auth-page">
        <section class="auth-card" aria-labelledby="login-title">
            <a class="brand" href="/login">TerminPilot</a>
            <div class="eyebrow">YOUR WORKFLOW STUDIO</div>
            <h1 id="login-title">Welcome back.</h1>
            <p>Sign in to manage your appointment workflows.</p>
            @if ($errors->any())
                <div class="auth-error" role="alert">{{ $errors->first() }}</div>
            @endif
            <form method="POST" action="/login">
                @csrf
                <label class="field"><span>Email address</span><input type="email" name="email" value="{{ old('email') }}" autocomplete="username" required autofocus></label>
                <label class="field"><span>Password</span><input type="password" name="password" autocomplete="current-password" required></label>
                <button class="btn primary full" type="submit">Sign in →</button>
            </form>
        </section>
    </main>
</body>
</html>
