<?php

/*
| Messages this application raises itself, as opposed to Laravel's own
| validation wording. Mirrored in lang/ar/messages.php.
*/

return [
    'account_disabled' => 'This account has been disabled.',
    'company_disabled' => 'This company account has been disabled.',
    'not_an_employee' => 'This account is not an employee and cannot be managed here.',
    'company_has_owner' => 'This company already has an owner. Remove or replace the existing one first.',
    'unknown_permission' => 'Unknown permission: :names',
    'company_required' => 'A super admin must specify which company this belongs to.',
    'image_type' => 'The image must be a JPEG, PNG or WebP file.',
    'image_unreadable' => 'The uploaded file is not a readable image.',
    'permissions_present' => 'Send the complete permission list; use [] to revoke all.',
    'permission_unknown' => 'One or more of the requested permissions does not exist.',
    'image_too_large' => 'The image may not be larger than 5 MB.',
    'end_before_start' => 'The end date must fall on or after the start date.',
    'rating_range' => 'The rating must be between 1 and 5 stars.',
    'current_password_incorrect' => 'The current password is not correct.',
    'password_must_differ' => 'The new password must differ from the current one.',
];
