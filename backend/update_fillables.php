<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$modelsDir = __DIR__.'/app/Models';
$models = glob($modelsDir.'/*Report.php');

foreach ($models as $modelPath) {
    if (basename($modelPath) === 'Report.php') continue;

    $content = file_get_contents($modelPath);
    preg_match('/protected \$table\s*=\s*[\'"]([^\'"]+)[\'"]/', $content, $matches);
    if (!$matches) continue;

    $table = $matches[1];
    $columns = Illuminate\Support\Facades\Schema::getColumnListing($table);
    
    if (empty($columns)) {
        echo "No columns found for $table\n";
        continue;
    }

    $fillableString = "protected \$fillable = [\n        '" . implode("', '", $columns) . "'\n    ];";
    
    // Replace existing fillable
    $newContent = preg_replace('/protected\s+\$fillable\s*=\s*\[.*?\];/s', $fillableString, $content);
    file_put_contents($modelPath, $newContent);
    echo "Updated " . basename($modelPath) . "\n";
}
