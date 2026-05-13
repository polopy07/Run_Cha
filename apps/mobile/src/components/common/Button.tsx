import { Button as NativeButton, type ButtonProps } from 'react-native';

export function Button(props: ButtonProps) {
  return <NativeButton {...props} />;
}
