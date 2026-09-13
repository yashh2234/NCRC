export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.js'],
            refresh: true,
            fonts: [
                bunny('Instrument Sans', {
                    weights: [400, 500, 600],
                }),
            ],
        }),
        tailwindcss(),
    ],
    server: {
        host: true,
        allowedHosts: [
            'conductor-baked-produce.ngrok-free.dev',
        ],
        watch: {
            ignored: ['**/storage/framework/views/**'],
        },
    },
});