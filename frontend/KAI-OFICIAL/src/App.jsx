import { useEffect, useState } from "react";
import axios from "axios";

function App() {
  const [data, setData] = useState(null);

  useEffect(() => {
    axios.get("http://localhost:8000/")
      .then(res => setData(res.data));
  }, []);

  return (
    <div>
      <h1>{data?.message}</h1>
    </div>
  );
}

export default App;