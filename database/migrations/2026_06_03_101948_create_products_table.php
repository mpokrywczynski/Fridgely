<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('family_id')->constrained()->cascadeOnDelete();
            $table->foreignId('storage_zone_id')->constrained()->cascadeOnDelete();
            $table->foreignId('added_by')->constrained('users')->cascadeOnDelete();
            $table->string('name');
            $table->string('name_raw')->nullable();
            $table->string('category')->nullable();
            $table->decimal('quantity', 8, 2)->default(1);
            $table->string('unit')->default('szt');
            $table->decimal('price', 8, 2)->nullable();
            $table->string('barcode')->nullable()->index();
            $table->date('purchase_date')->nullable();
            $table->date('expiry_date')->nullable();
            $table->timestamp('opened_at')->nullable();
            $table->date('opened_expiry_date')->nullable();
            $table->boolean('is_consumed')->default(false);
            $table->timestamp('consumed_at')->nullable();
            $table->timestamps();

            $table->index(['family_id', 'is_consumed', 'expiry_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
