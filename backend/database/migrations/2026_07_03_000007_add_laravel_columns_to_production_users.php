<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $schema = Schema::getConnection()->getSchemaBuilder();

        Schema::table('users', function (Blueprint $table) use ($schema): void {
            if (! $schema->hasColumn('users', 'is_admin')) {
                $table->boolean('is_admin')->default(false)->after('gender');
            }
            if (! $schema->hasColumn('users', 'remember_token')) {
                $table->rememberToken()->after('is_admin');
            }
            if (! $schema->hasColumn('users', 'created_at')) {
                $table->timestamps();
            }
            if (! $schema->hasColumn('users', 'last_login_at')) {
                $table->timestamp('last_login_at')->nullable()->after('updated_at');
            }
            if (! $schema->hasColumn('users', 'last_login_ip')) {
                $table->string('last_login_ip', 45)->nullable()->after('last_login_at');
            }
            if (! $schema->hasColumn('users', 'last_login_user_agent')) {
                $table->string('last_login_user_agent')->nullable()->after('last_login_ip');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $columns = ['is_admin', 'remember_token', 'created_at', 'updated_at', 'last_login_at', 'last_login_ip', 'last_login_user_agent'];
            $existing = array_filter($columns, fn (string $col) => Schema::getConnection()->getSchemaBuilder()->hasColumn('users', $col));
            if ($existing !== []) {
                $table->dropColumn($existing);
            }
        });
    }
};
