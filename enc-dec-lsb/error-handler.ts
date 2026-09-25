export type ToastType = 'error' | 'success' | 'info' | 'warning';

export function showToast(message: string, type: ToastType = 'error'): void {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    requestAnimationFrame(() => {
        requestAnimationFrame(() => toast.classList.add('show'));
    });

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300); 
    }, 4000);
}

window.addEventListener('error', function(event: ErrorEvent) {
    showToast(event.message || 'Сталася невідома помилка', 'error');
});

window.addEventListener('unhandledrejection', function(event: PromiseRejectionEvent) {
    let errorMsg = 'Невідома помилка';
    if (event.reason) {
        errorMsg = event.reason instanceof Error ? event.reason.message : String(event.reason);
    }
    showToast(errorMsg, 'error');
});