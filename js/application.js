// Wait till the browser is ready to render the game (avoids glitches)
var gm;
window.requestAnimationFrame(function () {
  gm = new GameManager(5, KeyboardInputManager, HTMLActuator, LocalStorageManager);
	fillFusionTable();
	fillDecayTable();
});
