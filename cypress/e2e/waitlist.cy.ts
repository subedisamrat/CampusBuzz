describe('Waitlist flow', () => {
  it('shows Join Waitlist when event is full', () => {
    cy.login('student@campusbuzz.com', 'Student@123');
    cy.visit('/events');
    cy.get('[data-testid="event-card"]').first().click();
    cy.get('[data-testid="join-waitlist-btn"]').should('be.visible');
    cy.get('[data-testid="register-btn"]').should('not.exist');
  });

  it('shows position after joining waitlist', () => {
    cy.login('student@campusbuzz.com', 'Student@123');
    cy.visit('/events/full-event-id');
    cy.get('[data-testid="join-waitlist-btn"]').click();
    cy.get('[data-testid="waitlist-position"]').should('contain', '#');
  });

  it('shows waitlisted events on /my-events', () => {
    cy.login('student@campusbuzz.com', 'Student@123');
    cy.visit('/my-events');
    cy.contains('Waitlisted').click();
    cy.get('[data-testid="waitlisted-event"]').should('have.length.greaterThan', 0);
  });
});
