<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>GetFridgely</title>
    <script>
        window.APP_URL       = '{{ rtrim(url(''), '/') }}';
        window.PUSHER_KEY    = '{{ config('broadcasting.connections.pusher.key') }}';
        window.PUSHER_CLUSTER = '{{ config('broadcasting.connections.pusher.options.cluster') }}';
    </script>
    @vite(['resources/scss/app.scss', 'resources/js/app.js'])
</head>
<body>
    <div id="app">
        <div style="display:flex;align-items:center;justify-content:center;min-height:100vh">
            <div class="spinner"></div>
        </div>
    </div>
</body>
</html>
