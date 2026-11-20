import { SignUp } from "./SignUp";

export interface SignInProps {
  initialIsLogin?: boolean;
}

export function SignIn(props: SignInProps) {
  return <SignUp initialIsLogin={props.initialIsLogin ?? true} />;
}

export default SignIn;
