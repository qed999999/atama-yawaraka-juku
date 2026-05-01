var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.UseDefaultFiles();   // wwwroot/index.html を既定に
app.UseStaticFiles();    // wwwroot 配信

app.MapFallbackToFile("index.html"); // SPA対策（どのURLでもindexに戻す）

app.Run();
