<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('expiry_rules', function (Blueprint $table) {
            $table->id();
            $table->string('category', 80);
            $table->string('subcategory', 80)->nullable();
            $table->string('keyword', 80)->nullable()->index();
            $table->unsignedSmallInteger('days_fresh');
            $table->unsignedSmallInteger('days_opened')->nullable();
            $table->timestamps();

            $table->index(['category', 'subcategory']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('expiry_rules');
    }
};
