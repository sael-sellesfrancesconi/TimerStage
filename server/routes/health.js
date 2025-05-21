// Nouveau endpoint pour tester la connectivité
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    server: 'ECOS Timer Server'
  });
});
