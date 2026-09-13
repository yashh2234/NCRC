<?php

use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\SearchController;
use App\Http\Controllers\Api\TrackingController;
use App\Http\Controllers\Api\BillingController;
use App\Http\Controllers\Api\InvoiceController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\ExpenseController;
use App\Http\Controllers\Api\PurchaseOrderController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\RegistrationController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\DueReportsController;
use App\Http\Controllers\Api\FinalReportsController;
use App\Http\Controllers\Api\UlrLinkController;
use App\Http\Controllers\Api\StoreController;
use App\Http\Controllers\Api\WorkflowTemplateController;
use App\Http\Controllers\Api\WorkflowStageController;
use App\Http\Controllers\Api\WorkflowTransitionController;
use App\Http\Controllers\Api\JobController;
use App\Http\Controllers\Api\JobAssignmentController;
use App\Http\Controllers\Api\PermissionController;
use App\Http\Controllers\Api\DocumentCategoryController;
use App\Http\Controllers\Api\DocumentController;
use App\Http\Controllers\Api\ClientController;
use App\Http\Controllers\Api\AnalyticsController;
use App\Http\Controllers\Api\InquiryController;
use App\Http\Controllers\Api\QuotationController;
use App\Http\Controllers\Api\WorkOrderController;
use App\Http\Controllers\Api\DispatchController;
use App\Http\Controllers\Api\OutsourceAssignmentController;
use App\Http\Controllers\Api\DepartmentController;
use App\Http\Controllers\Api\DesignationController;
use App\Http\Controllers\Api\TestCategoryController;
use App\Http\Controllers\Api\TestController;
use App\Http\Controllers\Api\TestStandardController;
use App\Http\Controllers\Api\TestMethodController;
use App\Http\Controllers\Api\VendorController;
use App\Http\Controllers\Api\VendorContactController;
use App\Http\Controllers\Api\VendorServiceController;
use App\Http\Controllers\Api\TechnicalReviewController;
use App\Http\Controllers\Api\ReportWorkflowController;
use App\Http\Controllers\Api\SampleController;
use App\Http\Controllers\Api\TestResultController;
use App\Http\Controllers\Api\ClientDocumentController;
use App\Http\Controllers\Api\ClientManagementController;
use Illuminate\Support\Facades\Route;

Route::get('/health', function () {
    return response()->json(['status' => 'ok']);
});

Route::post('/login', [AuthController::class, 'login']);
Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
Route::post('/reset-password', [AuthController::class, 'resetPassword']);

Route::middleware('auth:sanctum')->group(function (): void {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::post('/auth/change-password', [AuthController::class, 'changePassword']);
    Route::get('/sessions', [AuthController::class, 'sessions']);
    Route::delete('/sessions/{session}', [AuthController::class, 'revokeSession']);
    Route::get('/dashboard/summary', [DashboardController::class, 'summary']);
    Route::get('/dashboard/trends', [DashboardController::class, 'trends']);
    Route::get('/dashboard/my-queue', [DashboardController::class, 'myQueue']);
    Route::prefix('roles')->middleware('permission:view_roles')->group(function (): void {
        Route::get('/', [RoleController::class, 'index']);
        Route::get('{role}', [RoleController::class, 'show']);
    });
    Route::post('/roles', [RoleController::class, 'store'])->middleware('permission:create_roles');
    Route::put('/roles/{role}', [RoleController::class, 'update'])->middleware('permission:update_roles');
    Route::delete('/roles/{role}', [RoleController::class, 'destroy'])->middleware('permission:delete_roles');
    Route::get('/users', [UserController::class, 'index'])->middleware('permission:view_users');
    Route::get('/users/{user}', [UserController::class, 'show'])->middleware('permission:view_users');
    Route::post('/users', [UserController::class, 'store'])->middleware('permission:create_users');
    Route::put('/users/{user}', [UserController::class, 'update'])->middleware('permission:update_users');
    Route::delete('/users/{user}', [UserController::class, 'destroy'])->middleware('permission:delete_users');
    Route::get('/registrations', [RegistrationController::class, 'index']);
    Route::post('/registrations', [RegistrationController::class, 'store']);
    Route::put('/registrations/{registrationId}', [RegistrationController::class, 'update']);
    Route::delete('/registrations/{registrationId}', [RegistrationController::class, 'destroy']);
    Route::get('/registrations/generate-uid', [RegistrationController::class, 'generateUid']);
    Route::get('/registrations/export', [RegistrationController::class, 'export']);
    Route::post('/registrations/upload-scan', [RegistrationController::class, 'uploadScan']);
    Route::get('/registrations/search-customers', [RegistrationController::class, 'searchCustomers']);
    Route::get('registrations/{registration}/history', [RegistrationController::class, 'history']);
    Route::post('/registrations/{uidNo}/photos', [RegistrationController::class, 'uploadPhotos']);
        Route::get('/billing', [BillingController::class, 'index']);
        Route::get('/billing/due', [BillingController::class, 'due']);
        Route::get('/billing/due-attached', [BillingController::class, 'dueAttached']);
        Route::get('/billing/not-updated', [BillingController::class, 'notUpdated']);
        Route::get('/billing/payment-not-updated', [BillingController::class, 'notUpdated']);
        Route::get('/billing/export', [BillingController::class, 'export']);
        Route::get('/billing/sms-log', [BillingController::class, 'smsLog']);
        Route::get('/billing/{id}', [BillingController::class, 'show']);
        Route::post('/billing', [BillingController::class, 'store']);
        Route::post('/billing/send-sms', [BillingController::class, 'sendSms']);
        Route::post('/billing/send-all-sms', [BillingController::class, 'sendAllSms']);
        Route::put('/billing/{id}', [BillingController::class, 'update']);
        Route::put('/billing/registration/{id}', [BillingController::class, 'updateRegistration']);
        Route::delete('/billing/{id}', [BillingController::class, 'destroy']);
    Route::get('/reports/types', [ReportController::class, 'types']);
    Route::get('/reports/{type}', [ReportController::class, 'index']);
    Route::get('/reports/{type}/{reportId}', [ReportController::class, 'show']);
    Route::get('/reports/{type}/{reportId}/versions', [ReportController::class, 'versions']);
    Route::post('/reports/cube', [ReportController::class, 'createCube']);
    Route::post('/reports/{type}/create', [ReportController::class, 'createReport']);
    Route::put('/reports/{type}/{reportId}', [ReportController::class, 'update']);
    Route::delete('/reports/{type}/{reportId}', [ReportController::class, 'destroy']);
    Route::post('/reports/{reportId}/approve', [ReportController::class, 'approve']);
    Route::post('/reports/{reportId}/cancel', [ReportController::class, 'cancel']);
    Route::post('/reports/{reportId}/assign', [ReportController::class, 'assign']);
    Route::post('/reports/{reportId}/start-testing', [ReportController::class, 'startTesting']);
    Route::post('/reports/{reportId}/generate-report', [ReportController::class, 'generateReport']);
    Route::get('/reports/{reportId}/timeline', [ReportController::class, 'timeline']);
    Route::post('reports/{reportId}/reapprove', [ReportController::class, 'reapprove']);
    Route::post('reports/{type}/{reportId}/observations', [ReportController::class, 'saveObservations']);
    Route::get('/lab/assigned', [ReportController::class, 'myAssigned']);

    Route::get('/settings/company', [SettingsController::class, 'company']);
    Route::put('/settings/company', [SettingsController::class, 'updateCompany'])->middleware('permission:update_settings');

    Route::get('/expenses', [ExpenseController::class, 'index']);
    Route::post('/expenses', [ExpenseController::class, 'store']);
    Route::get('/expenses/export', [ExpenseController::class, 'export']);
    Route::get('/expenses/monthly-summary', [ExpenseController::class, 'monthlySummary']);
    Route::put('/expenses/{id}', [ExpenseController::class, 'update']);
    Route::delete('/expenses/{id}', [ExpenseController::class, 'destroy']);

    Route::apiResource('purchase-orders', PurchaseOrderController::class);
    Route::get('/purchase-orders/{id}/print', [PurchaseOrderController::class, 'printDiv']);

    Route::get('/audit-logs', [AuditLogController::class, 'index']);
    Route::get('/search', [SearchController::class, 'search']);

    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
    Route::post('/notifications/{notification}/read', [NotificationController::class, 'markRead']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);

    Route::apiResource('invoices', InvoiceController::class);
    Route::get('/invoices/{id}/print', [InvoiceController::class, 'printDiv']);

    Route::apiResource('invoices', \App\Http\Controllers\Api\InvoiceController::class)->only(['index', 'show', 'store', 'update', 'destroy']);
    Route::get('invoices/{id}/print', [\App\Http\Controllers\Api\InvoiceController::class, 'printInvoice']);

    Route::post('/track/ping', [TrackingController::class, 'ping']);
    Route::post('/track/page', [TrackingController::class, 'page']);
    Route::get('/track/summary', [TrackingController::class, 'summary']);
    Route::get('/track/user/{userId?}', [TrackingController::class, 'userActivity']);

    Route::get('reports/{type}/{id}/print', [ReportController::class, 'printReport']);
    Route::get('due-reports', [DueReportsController::class, 'index']);
    Route::get('final-reports', [FinalReportsController::class, 'index']);
    Route::get('final-reports/export', [FinalReportsController::class, 'export']);
    Route::delete('final-reports/{id}', [FinalReportsController::class, 'destroy']);

    Route::get('ulr-links/dropdown', [UlrLinkController::class, 'dropdown']);
    Route::apiResource('ulr-links', UlrLinkController::class)->only(['index', 'store', 'update', 'destroy']);
    Route::get('ulr-links/export', [UlrLinkController::class, 'export']);
    Route::get('ulr-links/register', [UlrLinkController::class, 'register']);
    Route::post('ulr-links/client-details', [UlrLinkController::class, 'getClientDetails']);

    Route::apiResource('stores', StoreController::class)->only(['index', 'store', 'update', 'destroy']);

    Route::get('reports/{type}/export', [ReportController::class, 'export']);

    Route::get('dashboard/cash-summary', [DashboardController::class, 'cashSummary']);
    Route::get('dashboard/yearly-report', [DashboardController::class, 'yearlyReport']);

    Route::prefix('workflow')->middleware('permission:manage_workflows')->group(function (): void {
        Route::post('seed', [WorkflowTemplateController::class, 'seed']);
        Route::apiResource('templates', WorkflowTemplateController::class)->only(['index', 'store', 'show', 'update', 'destroy']);

        Route::get('templates/{workflowTemplate}/stages', [WorkflowStageController::class, 'index']);
        Route::post('templates/{workflowTemplate}/stages', [WorkflowStageController::class, 'store']);
        Route::get('stages/{workflowStage}', [WorkflowStageController::class, 'show']);
        Route::put('stages/{workflowStage}', [WorkflowStageController::class, 'update']);
        Route::delete('stages/{workflowStage}', [WorkflowStageController::class, 'destroy']);

        Route::get('templates/{workflowTemplate}/transitions', [WorkflowTransitionController::class, 'index']);
        Route::post('templates/{workflowTemplate}/transitions', [WorkflowTransitionController::class, 'store']);
        Route::get('transitions/{workflowTransition}', [WorkflowTransitionController::class, 'show']);
        Route::put('transitions/{workflowTransition}', [WorkflowTransitionController::class, 'update']);
        Route::delete('transitions/{workflowTransition}', [WorkflowTransitionController::class, 'destroy']);
    });

    Route::prefix('jobs')->group(function (): void {
        Route::get('/', [JobController::class, 'index']);
        Route::post('/', [JobController::class, 'store']);
        Route::get('sla-summary', [JobController::class, 'slaSummary']);
        Route::post('link-registration', [JobController::class, 'linkRegistration']);
        Route::get('{job}', [JobController::class, 'show']);
        Route::put('{job}', [JobController::class, 'update']);
        Route::delete('{job}', [JobController::class, 'destroy']);
        Route::post('{job}/transition', [JobController::class, 'transition']);
        Route::get('{job}/allowed-transitions', [JobController::class, 'allowedTransitions']);
        Route::post('{job}/return-to-stage', [JobController::class, 'returnToStage']);
        Route::post('{job}/assign', [JobController::class, 'assign']);
        Route::post('{job}/cancel', [JobController::class, 'cancel']);
        Route::get('{job}/timeline', [JobController::class, 'timeline']);
        Route::get('{job}/assignments', [JobAssignmentController::class, 'index']);
        Route::post('{job}/assignments', [JobAssignmentController::class, 'store']);
        Route::put('assignments/{jobAssignment}', [JobAssignmentController::class, 'update']);
        Route::delete('assignments/{jobAssignment}', [JobAssignmentController::class, 'destroy']);
        Route::get('{job}/reports', [ReportWorkflowController::class, 'jobReports']);
        Route::post('{job}/reports/draft', [ReportWorkflowController::class, 'createDraft'])->middleware('stage.permission:stage.report-draft');
        Route::get('{job}/samples', [SampleController::class, 'index']);
        Route::post('{job}/samples', [SampleController::class, 'store'])->middleware('stage.permission:stage.sample-received');
        Route::get('{job}/billing', [BillingController::class, 'jobBilling']);
        Route::get('{job}/invoices', [InvoiceController::class, 'jobInvoices']);
        Route::get('{job}/dispatches', [DispatchController::class, 'jobDispatches']);
        Route::get('{job}/test-results', [TestResultController::class, 'index']);
        Route::post('{job}/test-results', [TestResultController::class, 'store']);
        Route::post('{job}/test-results/batch', [TestResultController::class, 'batchStore']);
    });

    Route::put('samples/{sample}', [SampleController::class, 'update']);
    Route::delete('samples/{sample}', [SampleController::class, 'destroy']);
    Route::put('test-results/{testResult}', [TestResultController::class, 'update']);
    Route::delete('test-results/{testResult}', [TestResultController::class, 'destroy']);

    Route::prefix('report-workflow')->group(function (): void {
        Route::post('{report}/observations', [ReportWorkflowController::class, 'saveObservations']);
        Route::post('{report}/submit', [ReportWorkflowController::class, 'submitForReview']);
        Route::post('{report}/approve', [ReportWorkflowController::class, 'approve']);
        Route::post('{report}/request-correction', [ReportWorkflowController::class, 'requestCorrection']);
        Route::post('{report}/lock', [ReportWorkflowController::class, 'lock']);
        Route::get('{report}/review-history', [ReportWorkflowController::class, 'reviewHistory']);
    });

    Route::prefix('permissions')->middleware('permission:manage_permissions')->group(function (): void {
        Route::get('/', [PermissionController::class, 'index']);
        Route::post('seed', [PermissionController::class, 'seed']);
        Route::get('roles/{role}', [PermissionController::class, 'rolePermissions']);
        Route::post('roles/{role}/sync', [PermissionController::class, 'syncRolePermissions']);
        Route::post('users/assign', [PermissionController::class, 'assignToUser']);
        Route::get('users/{userId}', [PermissionController::class, 'userPermissions']);
    });

    Route::prefix('documents')->group(function (): void {
        Route::get('/', [DocumentController::class, 'index']);
        Route::post('/', [DocumentController::class, 'store']);
        Route::post('bulk', [DocumentController::class, 'bulkStore']);
        Route::get('search', [DocumentController::class, 'search']);
        Route::get('categories/tree', [DocumentCategoryController::class, 'tree']);
        Route::get('categories', [DocumentCategoryController::class, 'index']);
        Route::post('categories', [DocumentCategoryController::class, 'store']);
        Route::get('categories/{documentCategory}', [DocumentCategoryController::class, 'show']);
        Route::put('categories/{documentCategory}', [DocumentCategoryController::class, 'update']);
        Route::delete('categories/{documentCategory}', [DocumentCategoryController::class, 'destroy']);
        Route::get('{document}', [DocumentController::class, 'show']);
        Route::put('{document}', [DocumentController::class, 'update']);
        Route::delete('{document}', [DocumentController::class, 'destroy']);
        Route::post('{document}/versions', [DocumentController::class, 'uploadVersion']);
        Route::get('{document}/download/{versionId?}', [DocumentController::class, 'download']);
        Route::get('{document}/preview', [DocumentController::class, 'preview']);
        Route::get('{document}/downloads', [DocumentController::class, 'downloadHistory']);
    });

    Route::prefix('clients')->group(function (): void {
        Route::get('/', [ClientController::class, 'index']);
        Route::post('/', [ClientController::class, 'store']);
        Route::get('search', [ClientController::class, 'search']);
        Route::get('list', [ClientController::class, 'list']);
        Route::get('analytics', [ClientController::class, 'analytics']);
        Route::post('migrate', [ClientController::class, 'migrateFromRegistrations']);
        Route::get('{client}', [ClientController::class, 'show']);
        Route::put('{client}', [ClientController::class, 'update']);
        Route::delete('{client}', [ClientController::class, 'destroy']);

        Route::post('{client}/contacts', [ClientController::class, 'storeContact']);
        Route::put('{client}/contacts/{contact}', [ClientController::class, 'updateContact']);
        Route::delete('{client}/contacts/{contact}', [ClientController::class, 'destroyContact']);

        Route::post('{client}/communications', [ClientController::class, 'storeCommunication']);
        Route::get('{client}/communications', [ClientController::class, 'communications']);
    });

    Route::prefix('departments')->group(function (): void {
        Route::get('/', [DepartmentController::class, 'index']); Route::post('/', [DepartmentController::class, 'store']);
        Route::get('list', [DepartmentController::class, 'list']); Route::get('{department}', [DepartmentController::class, 'show']);
        Route::put('{department}', [DepartmentController::class, 'update']); Route::delete('{department}', [DepartmentController::class, 'destroy']);
    });
    Route::prefix('designations')->group(function (): void {
        Route::get('/', [DesignationController::class, 'index']); Route::post('/', [DesignationController::class, 'store']);
        Route::get('list', [DesignationController::class, 'list']); Route::get('{designation}', [DesignationController::class, 'show']);
        Route::put('{designation}', [DesignationController::class, 'update']); Route::delete('{designation}', [DesignationController::class, 'destroy']);
    });
    Route::prefix('test-categories')->group(function (): void {
        Route::get('/', [TestCategoryController::class, 'index']); Route::post('/', [TestCategoryController::class, 'store']);
        Route::get('list', [TestCategoryController::class, 'list']); Route::get('{testCategory}', [TestCategoryController::class, 'show']);
        Route::put('{testCategory}', [TestCategoryController::class, 'update']); Route::delete('{testCategory}', [TestCategoryController::class, 'destroy']);
    });
    Route::prefix('tests')->group(function (): void {
        Route::get('/', [TestController::class, 'index']); Route::post('/', [TestController::class, 'store']);
        Route::get('list', [TestController::class, 'list']); Route::get('{test}', [TestController::class, 'show']);
        Route::put('{test}', [TestController::class, 'update']); Route::delete('{test}', [TestController::class, 'destroy']);
    });
    Route::prefix('test-standards')->group(function (): void {
        Route::get('/', [TestStandardController::class, 'index']); Route::post('/', [TestStandardController::class, 'store']);
        Route::put('{testStandard}', [TestStandardController::class, 'update']); Route::delete('{testStandard}', [TestStandardController::class, 'destroy']);
    });
    Route::prefix('test-methods')->group(function (): void {
        Route::get('/', [TestMethodController::class, 'index']); Route::post('/', [TestMethodController::class, 'store']);
        Route::put('{testMethod}', [TestMethodController::class, 'update']); Route::delete('{testMethod}', [TestMethodController::class, 'destroy']);
    });
    Route::prefix('vendors')->group(function (): void {
        Route::get('/', [VendorController::class, 'index']); Route::post('/', [VendorController::class, 'store']);
        Route::get('list', [VendorController::class, 'list']); Route::get('{vendor}', [VendorController::class, 'show']);
        Route::put('{vendor}', [VendorController::class, 'update']); Route::delete('{vendor}', [VendorController::class, 'destroy']);
    });
    Route::prefix('vendor-contacts')->group(function (): void {
        Route::get('/', [VendorContactController::class, 'index']); Route::post('/', [VendorContactController::class, 'store']);
        Route::put('{vendorContact}', [VendorContactController::class, 'update']); Route::delete('{vendorContact}', [VendorContactController::class, 'destroy']);
    });
    Route::prefix('vendor-services')->group(function (): void {
        Route::get('/', [VendorServiceController::class, 'index']); Route::post('/', [VendorServiceController::class, 'store']);
        Route::put('{vendorService}', [VendorServiceController::class, 'update']); Route::delete('{vendorService}', [VendorServiceController::class, 'destroy']);
    });
    Route::prefix('technical-reviews')->group(function (): void {
        Route::get('/', [TechnicalReviewController::class, 'index']); Route::post('/', [TechnicalReviewController::class, 'store']);
        Route::get('{technicalReview}', [TechnicalReviewController::class, 'show']);
        Route::put('{technicalReview}', [TechnicalReviewController::class, 'update']); Route::delete('{technicalReview}', [TechnicalReviewController::class, 'destroy']);
    });
    Route::prefix('client-documents')->group(function (): void {
        Route::get('/', [ClientDocumentController::class, 'index']); Route::post('/', [ClientDocumentController::class, 'store']);
        Route::delete('{clientDocument}', [ClientDocumentController::class, 'destroy']);
    });
    Route::prefix('client-management')->group(function (): void {
        Route::put('{client}/addresses', [ClientManagementController::class, 'updateAddresses']);
    });

    Route::prefix('inquiries')->group(function (): void {
        Route::get('/', [InquiryController::class, 'index']);
        Route::post('/', [InquiryController::class, 'store']);
        Route::get('{inquiry}', [InquiryController::class, 'show']);
        Route::put('{inquiry}', [InquiryController::class, 'update']);
        Route::delete('{inquiry}', [InquiryController::class, 'destroy']);
        Route::post('{inquiry}/convert', [InquiryController::class, 'convertToQuotation']);
    });

    Route::prefix('quotations')->group(function (): void {
        Route::get('/', [QuotationController::class, 'index']);
        Route::post('/', [QuotationController::class, 'store']);
        Route::get('{quotation}', [QuotationController::class, 'show']);
        Route::put('{quotation}', [QuotationController::class, 'update']);
        Route::delete('{quotation}', [QuotationController::class, 'destroy']);
        Route::get('{quotation}/print', [QuotationController::class, 'printDiv']);
        Route::post('{quotation}/convert-to-work-order', [QuotationController::class, 'convertToWorkOrder']);
        Route::post('{quotation}/convert-to-registration', [QuotationController::class, 'convertToRegistration']);
    });

    Route::prefix('work-orders')->group(function (): void {
        Route::get('/', [WorkOrderController::class, 'index']);
        Route::post('/', [WorkOrderController::class, 'store']);
        Route::get('{workOrder}', [WorkOrderController::class, 'show']);
        Route::put('{workOrder}', [WorkOrderController::class, 'update']);
        Route::delete('{workOrder}', [WorkOrderController::class, 'destroy']);
        Route::get('{workOrder}/print', [WorkOrderController::class, 'printDiv']);
    });

    Route::prefix('dispatches')->group(function (): void {
        Route::get('/', [DispatchController::class, 'index']);
        Route::post('/', [DispatchController::class, 'store']);
        Route::get('{dispatch}', [DispatchController::class, 'show']);
        Route::put('{dispatch}', [DispatchController::class, 'update']);
        Route::delete('{dispatch}', [DispatchController::class, 'destroy']);
    });

    Route::prefix('outsource')->group(function (): void {
        Route::get('/', [OutsourceAssignmentController::class, 'index']);
        Route::post('/', [OutsourceAssignmentController::class, 'store']);
        Route::get('{outsourceAssignment}', [OutsourceAssignmentController::class, 'show']);
        Route::put('{outsourceAssignment}', [OutsourceAssignmentController::class, 'update']);
        Route::delete('{outsourceAssignment}', [OutsourceAssignmentController::class, 'destroy']);
        Route::post('{outsourceAssignment}/upload-vendor-report', [OutsourceAssignmentController::class, 'uploadVendorReport']);
    });

    Route::prefix('analytics')->group(function (): void {
        Route::get('summary', [AnalyticsController::class, 'summary']);
        Route::get('export/{type}', [AnalyticsController::class, 'exportCsv']);
    });
});
