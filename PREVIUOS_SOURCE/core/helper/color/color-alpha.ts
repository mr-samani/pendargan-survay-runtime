import parse from './color-parse';

export function alpha(color: string, value: number) {
  try {
    var obj = parse(color);

    if (value == null) value = obj.alpha;

    //catch percent
    if (obj.space && obj.space[0] === 'h') {
      return obj.space + ['a(', obj.values[0], ',', obj.values[1], '%,', obj.values[2], '%,', value, ')'].join('');
    }

    return obj.space + ['a(', obj.values, ',', value, ')'].join('');
  } catch (error) {
    return color;
  }
}
