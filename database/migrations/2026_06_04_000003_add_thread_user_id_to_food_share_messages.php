<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('food_share_messages', function (Blueprint $table) {
            $table->unsignedBigInteger('thread_user_id')->nullable()->after('user_id');
            $table->foreign('thread_user_id')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('food_share_messages', function (Blueprint $table) {
            $table->dropForeign(['thread_user_id']);
            $table->dropColumn('thread_user_id');
        });
    }
};
