<?php

/*
|--------------------------------------------------------------------------
| Cross-Origin Resource Sharing
|--------------------------------------------------------------------------
|
| Only the two Next.js applications may call the API from a browser. The list
| comes from the environment so production never inherits localhost origins.
|
| `supports_credentials` is false on purpose: authentication is a bearer token
| that each Next.js app holds server-side, so the browser never sends cookies
| cross-origin and there is no CSRF surface on the API.
|
*/

return [

    'paths' => ['api/*'],

    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    'allowed_origins' => array_values(array_filter([
        env('FRONTEND_ADMIN_URL'),
        env('FRONTEND_COMPANY_URL'),
    ])),

    'allowed_origins_patterns' => [],

    'allowed_headers' => [
        'Accept',
        'Authorization',
        'Content-Type',
        'X-Requested-With',
        'X-Client-Source',
    ],

    'exposed_headers' => [],

    'max_age' => 3600,

    'supports_credentials' => false,

];
