<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Attendance (check in / out with location), time spent in the software, login security,
 * leave and the holiday calendar. `date` columns are Indian dates, dateTime columns are UTC.
 */
return new class extends Migration
{
    public function up(): void
    {
        // One row per spell; a user who checks in again after lunch has two on that day
        $this->create('attendances', function (Blueprint $table): void {
            $table->id();
            $table->unsignedInteger('user_id');
            $table->date('date');
            $table->dateTime('check_in_at');
            $table->dateTime('check_out_at')->nullable();
            foreach (['in', 'out'] as $side) {
                $table->decimal("{$side}_lat", 10, 7)->nullable();
                $table->decimal("{$side}_lng", 10, 7)->nullable();
                $table->unsignedInteger("{$side}_accuracy")->nullable();
                $table->string("{$side}_ip", 45)->nullable();
                $table->string("{$side}_note", 255)->nullable();
            }
            $table->boolean('auto_closed')->default(false);
            $table->unsignedBigInteger('correction_id')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'date']);
            $table->index('date');
        });

        $this->create('attendance_corrections', function (Blueprint $table): void {
            $table->id();
            $table->unsignedInteger('user_id')->index();
            $table->date('date');
            $table->dateTime('check_in_at');
            $table->dateTime('check_out_at')->nullable();
            $table->string('reason', 500);
            $table->string('status', 20)->default('pending')->index();
            $table->unsignedInteger('decided_by')->nullable();
            $table->dateTime('decided_at')->nullable();
            $table->string('remark', 500)->nullable();
            $table->json('before')->nullable();
            $table->timestamps();
        });

        $this->create('usage_days', function (Blueprint $table): void {
            $table->id();
            $table->unsignedInteger('user_id');
            $table->date('date');
            $table->unsignedInteger('active_seconds')->default(0);
            $table->unsignedInteger('idle_seconds')->default(0);
            $table->dateTime('first_at')->nullable();
            $table->dateTime('last_active_at')->nullable();
            $table->dateTime('last_ping_at')->nullable();
            $table->unique(['user_id', 'date']);
            $table->index('date');
        });

        $this->create('usage_modules', function (Blueprint $table): void {
            $table->id();
            $table->unsignedInteger('user_id');
            $table->date('date');
            $table->string('module', 60);
            $table->unsignedInteger('active_seconds')->default(0);
            $table->unique(['user_id', 'date', 'module']);
            $table->index('date');
        });

        $this->create('failed_logins', function (Blueprint $table): void {
            $table->id();
            $table->string('email', 255);
            $table->unsignedInteger('user_id')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent', 255)->nullable();
            $table->dateTime('created_at')->index();
        });

        if (! Schema::hasColumn('login_sessions', 'device_id')) {
            Schema::table('login_sessions', function (Blueprint $table): void {
                $table->string('device_id', 64)->nullable()->after('user_agent');
            });
        }
        if (! Schema::hasColumn('users', 'date_of_birth')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->date('date_of_birth')->nullable();
            });
        }

        $this->create('leave_types', function (Blueprint $table): void {
            $table->id();
            $table->string('name', 80);
            $table->string('code', 8);
            $table->string('color', 9)->default('#2563eb');
            // null = no limit; for a granted type (comp-off) only what the admin gives a user counts
            $table->decimal('yearly_days', 5, 1)->nullable();
            $table->boolean('granted')->default(false);
            $table->boolean('counts_present')->default(false);
            $table->boolean('active')->default(true);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        $this->create('leave_quotas', function (Blueprint $table): void {
            $table->id();
            $table->unsignedInteger('user_id');
            $table->unsignedBigInteger('leave_type_id');
            $table->unsignedSmallInteger('year');
            $table->decimal('days', 5, 1);
            $table->timestamps();
            $table->unique(['user_id', 'leave_type_id', 'year']);
        });

        $this->create('leave_requests', function (Blueprint $table): void {
            $table->id();
            $table->unsignedInteger('user_id')->index();
            $table->unsignedBigInteger('leave_type_id');
            $table->date('from_date');
            $table->date('to_date');
            $table->string('half', 10)->nullable();
            $table->decimal('days', 5, 1);
            $table->string('reason', 1000);
            $table->string('status', 20)->default('pending')->index();
            $table->unsignedInteger('decided_by')->nullable();
            $table->dateTime('decided_at')->nullable();
            $table->string('remark', 500)->nullable();
            $table->timestamps();
            $table->index(['from_date', 'to_date']);
        });

        $this->create('holidays', function (Blueprint $table): void {
            $table->id();
            $table->date('date');
            $table->string('name', 120);
            $table->string('type', 10)->default('holiday');
            $table->boolean('tentative')->default(false);
            $table->timestamps();
            $table->unique(['date', 'name']);
        });

        $this->create('optional_holiday_picks', function (Blueprint $table): void {
            $table->id();
            $table->unsignedInteger('user_id');
            $table->unsignedBigInteger('holiday_id');
            $table->timestamps();
            $table->unique(['user_id', 'holiday_id']);
        });

        $this->create('hr_settings', function (Blueprint $table): void {
            $table->string('key', 60)->primary();
            $table->json('value')->nullable();
        });

        $this->fill();
    }

    public function down(): void
    {
        foreach (['attendances', 'attendance_corrections', 'usage_days', 'usage_modules', 'failed_logins', 'leave_types', 'leave_quotas', 'leave_requests', 'holidays', 'optional_holiday_picks', 'hr_settings'] as $table) {
            Schema::dropIfExists($table);
        }
        Schema::table('login_sessions', fn (Blueprint $table) => $table->dropColumn('device_id'));
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('date_of_birth'));
    }

    private function create(string $name, Closure $columns): void
    {
        if (! Schema::hasTable($name)) {
            Schema::create($name, $columns);
        }
    }

    private function fill(): void
    {
        $now = now();
        if (! DB::table('leave_types')->exists()) {
            foreach ([
                ['Casual Leave', 'CL', '#2563eb', false, false],
                ['Sick Leave', 'SL', '#dc2626', false, false],
                ['Earned / Paid Leave', 'EL', '#15803d', false, false],
                ['Leave Without Pay', 'LWP', '#64748b', false, false],
                ['Comp-off', 'CO', '#7c3aed', true, false],
                ['On Duty / Site', 'OD', '#0e7490', false, true],
            ] as $i => [$name, $code, $color, $granted, $present]) {
                DB::table('leave_types')->insert([
                    'name' => $name, 'code' => $code, 'color' => $color, 'granted' => $granted, 'counts_present' => $present,
                    'active' => true, 'sort_order' => $i, 'created_at' => $now, 'updated_at' => $now,
                ]);
            }
        }

        if (! DB::table('holidays')->exists()) {
            // The Rajasthan order for 2027 is not published yet: its moving dates are marked tentative
            $lists = [
                '2026' => [false, '01-25 Devnarayan Jayanti|01-26 Republic Day|02-15 Maha Shivratri|03-02 Holika Dahan|03-03 Dhulandi (Holi)|03-20 Cheti Chand|03-21 Id-ul-Fitr|03-26 Ram Navami|03-31 Mahavir Jayanti|04-03 Good Friday|04-11 Mahatma Jyotiba Phule Jayanti|04-14 Dr. Ambedkar Jayanti|04-19 Parashuram Jayanti|05-28 Id-ul-Zuha|06-17 Maharana Pratap Jayanti|06-26 Muharram|08-09 World Tribal Day|08-15 Independence Day|08-26 Barawafat (Milad-un-Nabi)|08-28 Raksha Bandhan|09-04 Janmashtami|09-21 Ramdev Jayanti / Teja Dashmi|10-02 Gandhi Jayanti|10-11 Maharaja Agrasen Jayanti|10-19 Durga Ashtami|10-20 Vijaya Dashami|11-08 Diwali|11-09 Govardhan Puja|11-11 Bhai Dooj|11-24 Guru Nanak Jayanti|12-25 Christmas Day'],
                '2027' => [true, '01-26 Republic Day|03-06 Maha Shivratri|03-10 Id-ul-Fitr|03-21 Holika Dahan|03-22 Dhulandi (Holi)|03-26 Good Friday|04-07 Cheti Chand|04-11 Mahatma Jyotiba Phule Jayanti|04-14 Dr. Ambedkar Jayanti|04-15 Ram Navami|04-18 Mahavir Jayanti|05-08 Parashuram Jayanti|05-17 Id-ul-Zuha|06-07 Maharana Pratap Jayanti|06-16 Muharram|08-09 World Tribal Day|08-15 Independence Day|08-15 Barawafat (Milad-un-Nabi)|08-17 Raksha Bandhan|08-25 Janmashtami|09-10 Ramdev Jayanti / Teja Dashmi|09-30 Maharaja Agrasen Jayanti|10-02 Gandhi Jayanti|10-07 Durga Ashtami|10-09 Vijaya Dashami|10-29 Diwali|10-30 Govardhan Puja|10-31 Bhai Dooj|11-13 Guru Nanak Jayanti|12-25 Christmas Day'],
            ];
            $fixed = ['Republic Day', 'Independence Day', 'Gandhi Jayanti', 'Christmas Day', 'Dr. Ambedkar Jayanti', 'Mahatma Jyotiba Phule Jayanti', 'World Tribal Day', 'Good Friday'];
            foreach ($lists as $year => [$tentative, $list]) {
                foreach (explode('|', $list) as $entry) {
                    [$day, $name] = explode(' ', $entry, 2);
                    DB::table('holidays')->insert([
                        'date' => "{$year}-{$day}", 'name' => $name, 'type' => 'holiday',
                        'tentative' => $tentative && ! in_array($name, $fixed, true), 'created_at' => $now, 'updated_at' => $now,
                    ]);
                }
            }
        }
    }
};
