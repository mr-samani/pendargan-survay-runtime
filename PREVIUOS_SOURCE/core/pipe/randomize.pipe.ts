import { Pipe, PipeTransform, Injectable } from '@angular/core';

@Pipe({
  standalone: false,
  name: 'random',
})
@Injectable()
export class ArrayRandomizePipe implements PipeTransform {
  transform(array: any, Randomize: boolean = false, randomExceptOf: number = 0): any[] {
    if (!Array.isArray(array)) {
      return [];
    }
    if (Randomize) {
      return this.shuffle(array, randomExceptOf);
    } else {
      return array;
    }
  }

  shuffle(array: any[], randomExceptOf: number): any[] {
    let currentIndex = array.length - randomExceptOf;
    let temporaryValue: any[];
    let randomIndex: number;
    while (0 !== currentIndex) {
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex -= 1;
      temporaryValue = array[currentIndex];
      array[currentIndex] = array[randomIndex];
      array[randomIndex] = temporaryValue;
    }
    return array;
  }
}
