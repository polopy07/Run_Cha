import { Button, View } from 'react-native';
import { login, signup } from '../../firebase-auth';

export default function HomeScreen() {
  const handleLogin = async () => {
    try {
      const token = await login('test@gmail.com', 'test1234!');
      console.log('TOKEN:', token);
    } catch (error) {
      console.log(error);
    }
  };

  const handleSignup = async () => {
    try {
      const token = await signup('test2@gmail.com', 'test1234!');
      console.log('SIGNUP TOKEN:', token);
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 20,
      }}
    >
      <Button title="로그인 테스트" onPress={handleLogin} />

      <Button title="회원가입 테스트" onPress={handleSignup} />
    </View>
  );
}