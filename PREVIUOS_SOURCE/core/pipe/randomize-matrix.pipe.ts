import { Pipe, PipeTransform, Injectable } from '@angular/core';

@Pipe({
  standalone: false,
  name: 'randomMatrix',
})
@Injectable()
export class MatrixRandomizePipe implements PipeTransform {
  /**
   * - نمایش تصادفی سوال های ماتریس
   * - یک بعدی ، دو بعدی یا ...
   * @param array source array
   * @param Randomize boolean
   * @param dimention Matrix dimention => 1,2,
   * @returns shuffle array
   */
  transform(array: any, Randomize: boolean = false, dimention = 1): any[] {
    if (!Array.isArray(array)) {
      return [];
    }
    if (Randomize) {
      return this.shuffle(array, dimention);
    } else {
      return array;
    }
  }

  private shuffle(array: any[], dimention: number): any[] {
    // اگر طول آرایه به بعد بخش پذیر نبود باید خطا بدهد
    if (array.length % dimention !== 0) {
      console.error('The length of the matrix questions is not divisible by the dimension of the matrix!');
      return [];
    }
    let currentIndex = array.length;
    while (0 < currentIndex) {
      const randomIndex = Math.floor((Math.random() * currentIndex) / dimention) * dimention;
      currentIndex -= dimention;
      const tempArr: any[] = [];
      for (let i = 0; i < dimention; i++) {
        tempArr[i] = array[currentIndex + i];
        array[currentIndex + i] = array[randomIndex + i];
        array[randomIndex + i] = tempArr[i];
      }
    }
    return array;
  }
}
