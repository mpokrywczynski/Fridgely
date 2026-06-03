<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Admin — GetFridgely</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, sans-serif; background: #f3f4f6; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
.box { background: #fff; border-radius: 12px; padding: 40px; width: 100%; max-width: 360px; box-shadow: 0 4px 24px rgba(0,0,0,.08); }
h1 { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
p { font-size: 13px; color: #6b7280; margin-bottom: 24px; }
label { display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px; }
input { width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; outline: none; }
input:focus { border-color: #4ade80; box-shadow: 0 0 0 3px rgba(74,222,128,.15); }
button { width: 100%; margin-top: 16px; padding: 11px; background: #16a34a; color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
button:hover { background: #15803d; }
.err { color: #dc2626; font-size: 13px; margin-top: 8px; }
</style>
</head>
<body>
<div class="box">
    <h1>🧊 GetFridgely Admin</h1>
    <p>Zaloguj się do panelu administracyjnego.</p>
    <form method="POST" action="{{ route('admin.login.submit') }}">
        @csrf
        <label>Hasło</label>
        <input type="password" name="password" autofocus required />
        @error('password') <div class="err">{{ $message }}</div> @enderror
        <button type="submit">Zaloguj →</button>
    </form>
</div>
</body>
</html>
