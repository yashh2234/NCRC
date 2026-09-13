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
            if (! $schema->hasColumn('users', 'is_active')) {
                $table->boolean('is_active')->default(true)->after('is_admin');
            }
            if (! $schema->hasColumn('users', 'last_activity_at')) {
                $table->timestamp('last_activity_at')->nullable()->after('last_login_user_agent');
            }
        });

        if (! Schema::hasTable('user_activities')) {
            Schema::create('user_activities', function (Blueprint $table): void {
                $table->bigIncrements('id');
                $table->unsignedInteger('user_id')->index();
                $table->string('action');
                $table->string('module')->nullable();
                $table->text('details')->nullable();
                $table->string('ip_address', 45)->nullable();
                $table->timestamp('created_at')->nullable();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('user_activities');
        Schema::table('users', function (Blueprint $table): void {
            $columns = array_filter(['is_active', 'last_activity_at'], fn (string $col) => Schema::getConnection()->getSchemaBuilder()->hasColumn('users', $col));
            if ($columns !== []) {
                $table->dropColumn($columns);
            }
        });
    }
};
