import { useEffect, useState } from "react";

const App = () => {
  const [message, setMessage] = useState("Hi");

  useEffect(() => {
    const hello = async () => {
      const result = await fetch("http://localhost:3000/hello")
      const data: { message: string } = await result.json();
      return data.message;
    }

    hello().then((message) => setMessage(message));
  }, []);

  return <main>
    {message}
  </main>
}

export default App
