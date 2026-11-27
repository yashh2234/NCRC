<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    // Tender document summaries (Google Gemini API; free tier works). Set GEMINI_API_KEY in .env.
    'gemini' => [
        'key' => env('GEMINI_API_KEY'),
        'model' => env('GEMINI_MODEL', 'gemini-flash-lite-latest'),
        // Used automatically when the main model is overloaded (common on the free tier).
        'fallback_model' => env('GEMINI_FALLBACK_MODEL', 'gemini-flash-latest'),
    ],

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    // Phone / browser notifications (php artisan push:keys makes the key pair)
    'webpush' => [
        'subject' => env('WEBPUSH_SUBJECT', 'https://ncrc.namotech.in'),
        'public_key' => env('WEBPUSH_PUBLIC_KEY', ''),
        'private_key' => env('WEBPUSH_PRIVATE_KEY', ''),
    ],

];
