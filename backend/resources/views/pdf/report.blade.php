<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #222; }
        h1 { margin: 0 0 5px; }
        table { width: 100%; border-collapse: collapse; margin-top: 14px; }
        th, td { border: 1px solid #bbb; padding: 6px; vertical-align: top; }
        th { background: #eef3f2; }
    </style>
</head>
<body>
    <h1>{{ $company->name ?? config('app.name') }}</h1>
    <p>Report #{{ $report->iReportId ?? '' }} | Type: {{ $report->report_type ?? '' }}</p>
    <table>
        <thead>
            <tr>
                <th>Field</th>
                <th>Value</th>
            </tr>
        </thead>
        <tbody>
            @foreach($report->getAttributes() as $key => $value)
                <tr>
                    <td>{{ $key }}</td>
                    <td>{{ is_array($value) || is_object($value) ? json_encode($value) : $value }}</td>
                </tr>
            @endforeach
            @foreach($details as $detail)
                @foreach($detail->getAttributes() as $key => $value)
                    <tr>
                        <td>{{ $key }}</td>
                        <td>{{ is_array($value) || is_object($value) ? json_encode($value) : $value }}</td>
                    </tr>
                @endforeach
            @endforeach
        </tbody>
    </table>
</body>
</html>
