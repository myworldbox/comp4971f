const request = {
  post: async (url, request) => {
    return await fetch(url, {
      method: "POST",
      body: JSON.stringify(request),
      headers: { "Content-type": "application/json; charset=UTF-8" },
    });
  },
};

module.exports = request;
