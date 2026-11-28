export class AnimationPageChange {
  /**
   * انیمشن برای رفتن به صفحه بعدی یا قبلی
   * @param isNext به صفحه بعد برود؟
   */
  public static animationSlide(isNext: boolean): void {
    AnimationPageChange.toggller(isNext, 'animation-slide-left', 'animation-slide-right');
  }

  public static animationFade(isNext: boolean): void {
    AnimationPageChange.toggller(isNext, 'animation-fade-start', 'animation-fade-end');
  }

  public static animationBlur(isNext: boolean): void {
    AnimationPageChange.toggller(isNext, 'animation-blur-start', 'animation-blur-end');
  }

  private static toggller(isNext: boolean, outClass: string, inClass: string) {
    const mainDiv = document.querySelector('.main-container');
    const html = document.querySelector('html');
    const body = document.querySelector('body');
    window.scrollTo({
      behavior: undefined,
      left: 0,
      top: 0,
    });
    if (mainDiv && html && body) {
      html.style.overflowX = 'hidden';
      body.style.overflowX = 'hidden';
      if (isNext === true) {
        mainDiv.classList.add(outClass);
      } else {
        mainDiv.classList.add(inClass);
      }

      setTimeout(() => {
        mainDiv.classList.remove(outClass);
        mainDiv.classList.remove(inClass);
        html.style.overflowX = 'unset';
        body.style.overflowX = 'unset';
      }, 1000);
    }
  }
}
