async function test() {
  const req = await fetch('http://localhost:3000/api/geocode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: 'Av Paulista' })
  });
  const text = await req.text();
  console.log(text);
}
test();
