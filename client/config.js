
// Client configuration variables.
// This should match the server.
module.exports = {
  // How often the system should attempt to reconnect with the server if connection lost.
  reconnectDuration: 5, // In seconds.

  // How often the system should revalidate it's token with the server.
  revalidateDuration: 12 * 60 // In seconds.
};
