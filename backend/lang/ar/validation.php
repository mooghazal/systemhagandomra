<?php

/*
|--------------------------------------------------------------------------
| Arabic validation messages
|--------------------------------------------------------------------------
|
| Only the rules this application actually uses are translated. Laravel falls
| back to the English file for anything missing, so an untranslated rule
| produces an English sentence rather than a raw key — visibly wrong, which is
| what you want, instead of silently wrong.
|
| `:attribute` is replaced by the field name from the `attributes` array at the
| bottom.
|
*/

return [
    'accepted' => 'يجب قبول :attribute.',
    'after' => 'يجب أن يكون :attribute تاريخاً بعد :date.',
    'after_or_equal' => 'يجب أن يكون :attribute تاريخاً بعد أو يساوي :date.',
    'alpha' => 'يجب أن يحتوي :attribute على حروف فقط.',
    'array' => 'يجب أن يكون :attribute قائمة.',
    'before' => 'يجب أن يكون :attribute تاريخاً قبل :date.',
    'before_or_equal' => 'يجب أن يكون :attribute تاريخاً قبل أو يساوي :date.',
    'boolean' => 'يجب أن تكون قيمة :attribute صحيحة أو خاطئة.',
    'confirmed' => 'تأكيد :attribute غير مطابق.',
    'date' => 'يجب أن يكون :attribute تاريخاً صحيحاً.',
    'email' => 'يجب أن يكون :attribute بريداً إلكترونياً صحيحاً.',
    'exists' => 'القيمة المحدّدة في :attribute غير موجودة.',
    'file' => 'يجب أن يكون :attribute ملفاً.',
    'image' => 'يجب أن يكون :attribute صورة.',
    'in' => 'القيمة المحدّدة في :attribute غير صحيحة.',
    'integer' => 'يجب أن يكون :attribute رقماً صحيحاً.',
    'mimes' => 'يجب أن يكون :attribute ملفاً من نوع: :values.',
    'numeric' => 'يجب أن يكون :attribute رقماً.',
    'present' => 'يجب إرسال :attribute.',
    'prohibited' => 'لا يُسمح بإرسال :attribute.',
    'required' => 'حقل :attribute مطلوب.',
    'required_with' => 'حقل :attribute مطلوب عند وجود :values.',
    'size' => [
        'string' => 'يجب أن يكون :attribute :size أحرف بالضبط.',
    ],
    'string' => 'يجب أن يكون :attribute نصاً.',
    'unique' => ':attribute مستخدم من قبل.',
    'uploaded' => 'فشل رفع :attribute.',
    'url' => 'يجب أن يكون :attribute رابطاً صحيحاً.',

    'max' => [
        'array' => 'يجب ألّا يحتوي :attribute على أكثر من :max عنصر.',
        'file' => 'يجب ألّا يتجاوز حجم :attribute :max كيلوبايت.',
        'numeric' => 'يجب ألّا تتجاوز قيمة :attribute :max.',
        'string' => 'يجب ألّا يتجاوز :attribute :max حرفاً.',
    ],

    'min' => [
        'array' => 'يجب أن يحتوي :attribute على :min عنصر على الأقل.',
        'file' => 'يجب ألّا يقلّ حجم :attribute عن :min كيلوبايت.',
        'numeric' => 'يجب ألّا تقلّ قيمة :attribute عن :min.',
        'string' => 'يجب ألّا يقلّ :attribute عن :min أحرف.',
    ],

    'between' => [
        'array' => 'يجب أن يحتوي :attribute على ما بين :min و :max عنصر.',
        'numeric' => 'يجب أن تكون قيمة :attribute بين :min و :max.',
        'string' => 'يجب أن يكون :attribute بين :min و :max حرفاً.',
    ],

    'password' => [
        'letters' => 'يجب أن تحتوي :attribute على حرف واحد على الأقل.',
        'mixed' => 'يجب أن تحتوي :attribute على حرف كبير وحرف صغير.',
        'numbers' => 'يجب أن تحتوي :attribute على رقم واحد على الأقل.',
        'symbols' => 'يجب أن تحتوي :attribute على رمز واحد على الأقل.',
        'uncompromised' => 'ظهرت :attribute في تسريب بيانات. اختر كلمة مرور أخرى.',
    ],

    'custom' => [],

    /*
     * Field names, so a message reads "حقل اسم الباقة مطلوب" rather than
     * "حقل name مطلوب".
     */
    'attributes' => [
        'name' => 'الاسم',
        'email' => 'البريد الإلكتروني',
        'password' => 'كلمة المرور',
        'phone' => 'الهاتف',
        'address' => 'العنوان',
        'domain' => 'النطاق',
        'logo' => 'الشعار',
        'image' => 'الصورة',
        'is_active' => 'الحالة',
        'company_id' => 'الشركة',
        'permissions' => 'الصلاحيات',

        'description' => 'الوصف',
        'price' => 'السعر',
        'currency' => 'العملة',
        'days' => 'عدد الأيام',
        'start_date' => 'تاريخ البداية',
        'end_date' => 'تاريخ النهاية',
        'trip_type' => 'نوع الرحلة',
        'location' => 'الموقع',
        'features' => 'المزايا',

        'distance_from_haram' => 'المسافة من الحرم',
        'distance_from_masjid_nabawi' => 'المسافة من المسجد النبوي',
        'rating' => 'التقييم',
        'room_type' => 'نوع الغرفة',

        'type' => 'النوع',
        'capacity' => 'السعة',
        'model' => 'الموديل',

        'owner' => 'المالك',
        'owner.name' => 'اسم المالك',
        'owner.email' => 'بريد المالك',
        'owner.password' => 'كلمة مرور المالك',
        'owner.phone' => 'هاتف المالك',
    ],
];
