<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return (bool) ($user && ($user->canManageUsers() || in_array('createUser', $user->legacyPermissions(), true)));
    }

    public function rules(): array
    {
        return [
            'group_id' => ['nullable', 'integer', Rule::exists('groups', 'id')],
            'is_admin' => ['nullable', 'boolean'],
            'tracker_role' => ['nullable', 'string', Rule::in(\App\Models\User::JOB_ROLES)],
            'allowed_modules' => ['nullable', 'array'],
            'allowed_modules.*' => ['string', Rule::in(\App\Models\User::FEATURE_KEYS)],
            'username' => ['required', 'string', 'min:5', 'max:12', 'unique:users,username'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'firstname' => ['required', 'string', 'max:255'],
            'lastname' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:255'],
            'gender' => ['required', 'integer', Rule::in([1, 2])],
            'date_of_birth' => ['nullable', 'date_format:Y-m-d', 'before:today'],
        ];
    }
}