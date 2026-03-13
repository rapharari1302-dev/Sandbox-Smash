import sys
import random
import pygame


WIDTH, HEIGHT = 900, 600
FPS = 60


class Car(pygame.sprite.Sprite):
    def __init__(self, pos):
        super().__init__()
        w, h = 64, 36
        self.image = pygame.Surface((w, h), pygame.SRCALPHA)
        color = (random.randint(50, 255), random.randint(50, 255), random.randint(50, 255))
        pygame.draw.rect(self.image, color, (0, 0, w, h), border_radius=6)
        pygame.draw.circle(self.image, (30, 30, 30), (14, h - 6), 8)
        pygame.draw.circle(self.image, (30, 30, 30), (w - 14, h - 6), 8)
        self.rect = self.image.get_rect(center=pos)


class Bomb(pygame.sprite.Sprite):
    def __init__(self, x):
        super().__init__()
        size = 18
        self.image = pygame.Surface((size, size), pygame.SRCALPHA)
        pygame.draw.circle(self.image, (20, 20, 20), (size // 2, size // 2), size // 2)
        pygame.draw.circle(self.image, (200, 40, 40), (size // 2, size // 2), size // 2 - 2)
        self.rect = self.image.get_rect(center=(x, -30))
        self.pos = pygame.math.Vector2(self.rect.topleft)
        self.vy = 0.0

    def update(self):
        self.vy += 0.6
        self.pos.y += self.vy
        self.rect.y = int(self.pos.y)
        if self.rect.top > HEIGHT + 100:
            self.kill()


class Explosion(pygame.sprite.Sprite):
    def __init__(self, pos):
        super().__init__()
        self.pos = pos
        self.life = 28

    def update(self):
        self.life -= 1
        if self.life <= 0:
            self.kill()

    def draw(self, surface):
        t = (28 - self.life) / 28
        radius = int(8 + 48 * t)
        alpha = int(200 * (1 - t))
        if alpha < 0:
            alpha = 0
        s = pygame.Surface((radius * 2, radius * 2), pygame.SRCALPHA)
        pygame.draw.circle(s, (255, 160, 0, alpha), (radius, radius), radius)
        surface.blit(s, (self.pos[0] - radius, self.pos[1] - radius))


def main():
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption('Autos + Bomben (P spawn, Linksklick zerstört)')
    clock = pygame.time.Clock()

    font = pygame.font.SysFont(None, 20)

    cars = pygame.sprite.Group()
    bombs = pygame.sprite.Group()
    explosions = pygame.sprite.Group()

    running = True
    while running:
        dt = clock.tick(FPS) / 1000.0
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_p:
                    mx, my = pygame.mouse.get_pos()
                    car = Car((mx, my))
                    cars.add(car)
                elif event.key == pygame.K_ESCAPE:
                    running = False
            elif event.type == pygame.MOUSEBUTTONDOWN:
                if event.button == 1:  # left click
                    mx, my = event.pos
                    # find car under mouse
                    for car in cars.sprites():
                        if car.rect.collidepoint((mx, my)):
                            # spawn bomb above the car's x
                            bx = car.rect.centerx + random.randint(-8, 8)
                            bomb = Bomb(bx)
                            bombs.add(bomb)
                            break

        # update
        bombs.update()
        # collision: bombs hit cars
        collided = pygame.sprite.groupcollide(bombs, cars, True, True)
        for bomb, hitlist in collided.items():
            for car in hitlist:
                exp = Explosion(car.rect.center)
                explosions.add(exp)

        explosions.update()

        # draw
        screen.fill((28, 30, 40))
        cars.draw(screen)
        bombs.draw(screen)
        for e in explosions.sprites():
            e.draw(screen)

        # HUD
        lines = [
            'Tasten: P = Auto spawnen (bei Mausposition)',
            'Linksklick auf ein Auto = Bombe fällt vom Himmel und zerstört es',
            f'Autos: {len(cars)}   Bomben: {len(bombs)}   Explosionen: {len(explosions)}',
            'Drücke ESC oder schließe Fenster zum Beenden.'
        ]
        for i, l in enumerate(lines):
            txt = font.render(l, True, (230, 230, 230))
            screen.blit(txt, (8, 8 + i * 18))

        pygame.display.flip()

    pygame.quit()
    sys.exit()


if __name__ == '__main__':
    main()
