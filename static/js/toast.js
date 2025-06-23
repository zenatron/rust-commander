export class ToastManager {
  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'toast-container';
    document.body.appendChild(this.container);
  }

  show(message, type = 'info', duration = 4000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icon = this.getIcon(type);
    toast.innerHTML = `
      <div class="toast-content">
        ${icon} <p>${message}</p>
      </div>
      <small class="toast-dismiss-note">click to dismiss</small>
    `;

    this.container.appendChild(toast);

    // Animate in
    setTimeout(() => {
      toast.classList.add('show');
    }, 100);

    // Animate out and remove
    const timeoutId = setTimeout(() => {
      toast.classList.remove('show');
      toast.addEventListener('transitionend', () => {
        if (toast.parentElement) {
          toast.parentElement.removeChild(toast);
        }
      });
    }, duration);

    // Allow user to close toast by clicking on it
    toast.addEventListener('click', () => {
        clearTimeout(timeoutId);
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => {
            if (toast.parentElement) {
                toast.parentElement.removeChild(toast);
            }
        });
    });
  }

  getIcon(type) {
    switch (type) {
      case 'success':
        return '<i class="fas fa-check-circle"></i>';
      case 'error':
        return '<i class="fas fa-times-circle"></i>';
      case 'warn':
        return '<i class="fas fa-exclamation-triangle"></i>';
      case 'info':
      default:
        return '<i class="fas fa-info-circle"></i>';
    }
  }
} 